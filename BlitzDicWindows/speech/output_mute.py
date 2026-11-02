"""Optional default-output mute lease. No volume-level changes or audio capture."""
import ctypes as c
import json
import sys
from uuid import UUID


class GUID(c.Structure):
    _fields_ = [('data1', c.c_uint32), ('data2', c.c_uint16), ('data3', c.c_uint16), ('data4', c.c_ubyte * 8)]

    @classmethod
    def parse(cls, value):
        return cls.from_buffer_copy(UUID(value).bytes_le)


class Endpoint:
    # Windows SDK mmdeviceapi.h / endpointvolume.h, IUnknown occupies slots 0..2.
    def __init__(self):
        self.pointer = c.c_void_p()
        self.initialized = False
        self.ole = c.WinDLL('ole32')
        self.ole.CoInitializeEx.argtypes = [c.c_void_p, c.c_ulong]
        self.ole.CoInitializeEx.restype = c.c_long
        self.ole.CoCreateInstance.argtypes = [c.POINTER(GUID), c.c_void_p, c.c_ulong,
                                              c.POINTER(GUID), c.POINTER(c.c_void_p)]
        self.ole.CoCreateInstance.restype = c.c_long
        self.ole.CoUninitialize.argtypes = []
        self.ole.CoUninitialize.restype = None
        enumerator, device = c.c_void_p(), c.c_void_p()
        try:
            self.check(self.ole.CoInitializeEx(None, 0))  # COINIT_MULTITHREADED
            self.initialized = True
            clsid = GUID.parse('BCDE0395-E52F-467C-8E3D-C4579291692E')
            iid = GUID.parse('A95664D2-9614-4F35-A746-DE8DB63617E6')
            self.check(self.ole.CoCreateInstance(c.byref(clsid), None, 1, c.byref(iid), c.byref(enumerator)))
            # eRender=0, eMultimedia=1: snapshot this endpoint, not a later default.
            self.check(self.call(enumerator, 4, [c.c_int, c.c_int, c.POINTER(c.c_void_p)], 0, 1, c.byref(device)))
            iid = GUID.parse('5CDF2C82-841E-4546-9722-0CF74078229A')
            self.check(self.call(device, 3, [c.POINTER(GUID), c.c_ulong, c.c_void_p, c.POINTER(c.c_void_p)],
                                 c.byref(iid), 23, None, c.byref(self.pointer)))
        except Exception:
            self.release(device); device = c.c_void_p()
            self.release(enumerator); enumerator = c.c_void_p()
            self.close()
            raise
        finally:
            self.release(device)
            self.release(enumerator)

    @staticmethod
    def check(result):
        if result < 0:
            raise RuntimeError('Windows-Audioausgabe nicht verfügbar.')

    @staticmethod
    def call(pointer, slot, arguments, *values):
        table = c.cast(pointer, c.POINTER(c.POINTER(c.c_void_p))).contents
        method = c.WINFUNCTYPE(c.c_long, c.c_void_p, *arguments)(table[slot])
        return method(pointer, *values)

    @staticmethod
    def release(pointer):
        if pointer:
            table = c.cast(pointer, c.POINTER(c.POINTER(c.c_void_p))).contents
            c.WINFUNCTYPE(c.c_ulong, c.c_void_p)(table[2])(pointer)

    def muted(self):
        value = c.c_int()
        self.check(self.call(self.pointer, 15, [c.POINTER(c.c_int)], c.byref(value)))
        return bool(value.value)

    def set_muted(self, value):
        self.check(self.call(self.pointer, 14, [c.c_int, c.c_void_p], int(value), None))

    def close(self):
        self.release(self.pointer)
        self.pointer = c.c_void_p()
        if self.initialized:
            self.ole.CoUninitialize()
            self.initialized = False


class MuteLease:
    def __init__(self, open_endpoint=Endpoint):
        self.open_endpoint = open_endpoint
        self.endpoint = None

    def set_active(self, active):
        if not active:
            self.restore()
            return
        if self.endpoint is not None:
            return
        endpoint = self.open_endpoint()
        try:
            if endpoint.muted():
                endpoint.close()  # Already muted: nothing belongs to this lease.
                return
        except Exception:
            endpoint.close()
            raise
        self.endpoint = endpoint
        try:
            endpoint.set_muted(True)
        except Exception:
            # Keep ownership if restoration fails, so EOF can retry the same device.
            try:
                self.restore()
            except Exception:
                pass
            raise

    def restore(self):
        endpoint = self.endpoint
        if endpoint is not None:
            endpoint.set_muted(False)
            self.endpoint = None
            endpoint.close()

    def close(self):
        try:
            self.restore()
        finally:
            endpoint, self.endpoint = self.endpoint, None
            if endpoint is not None:
                endpoint.close()


def serve(input_stream=None, output_stream=None, open_endpoint=Endpoint):
    incoming, outgoing = input_stream or sys.stdin, output_stream or sys.stdout
    lease = MuteLease(open_endpoint)

    def emit(value):
        outgoing.write(json.dumps(value, ensure_ascii=True) + '\n')
        outgoing.flush()

    try:
        emit({'event': 'ready'})
        for line in incoming:
            request = {}
            try:
                request = json.loads(line)
                if not isinstance(request, dict) or type(request.get('id')) is not int or type(request.get('active')) is not bool:
                    raise ValueError('Invalid mute command')
                lease.set_active(request['active'])
                emit({'event': 'state', 'id': request['id'], 'active': request['active']})
            except Exception:
                emit({'event': 'error', 'id': request.get('id') if isinstance(request, dict) else None})
    finally:
        lease.close()  # EOF/parent exit restores only the endpoint we changed.
