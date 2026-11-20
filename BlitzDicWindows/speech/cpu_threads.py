"""CPU thread count for speech recognition.

faster-whisper uses only 4 threads unless told otherwise. Use the physical cores
instead (hyperthreads stay free for Windows and the app), at most 8: more threads
gain little for these model sizes and spread onto slower efficiency cores of
hybrid CPUs. Not yet measured on the practice PCs; BLITZDIC_CPU_THREADS (1-64)
overrides the choice for measurements.
"""
import ctypes
import os
import struct

RELATION_PROCESSOR_CORE = 0
MAXIMUM = 8


def physical_cores():
    """Physical cores reported by Windows; the logical count if that fails."""
    try:
        kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
        query = kernel32.GetLogicalProcessorInformationEx
        query.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
        query.restype = ctypes.c_int
        length = ctypes.c_uint32(0)
        query(RELATION_PROCESSOR_CORE, None, ctypes.byref(length))
        buffer = ctypes.create_string_buffer(length.value)
        if not length.value or not query(RELATION_PROCESSOR_CORE, buffer, ctypes.byref(length)):
            raise OSError('GetLogicalProcessorInformationEx failed')
        return count_cores(buffer.raw[:length.value]) or os.cpu_count() or 4
    except Exception:
        return os.cpu_count() or 4


def count_cores(records):
    """Count RelationProcessorCore entries in SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX data."""
    count = offset = 0
    while offset + 8 <= len(records):
        relationship, size = struct.unpack_from('<II', records, offset)
        if size < 8:
            break
        count += relationship == RELATION_PROCESSOR_CORE
        offset += size
    return count


def override():
    value = os.environ.get('BLITZDIC_CPU_THREADS', '')
    return int(value) if value.isdigit() and 1 <= int(value) <= 64 else None


def inference_threads():
    return override() or max(1, min(MAXIMUM, physical_cores()))
