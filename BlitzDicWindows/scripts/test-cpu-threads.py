"""Thread choice for speech recognition, without loading ASR libraries."""
import os
from pathlib import Path
import struct
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
import cpu_threads


def record(relationship, size=48):
    return struct.pack('<II', relationship, size) + bytes(size - 8)


class CpuThreadTests(unittest.TestCase):
    def test_counts_core_records_and_stops_on_malformed_sizes(self):
        self.assertEqual(cpu_threads.count_cores(record(0) * 6), 6)
        self.assertEqual(cpu_threads.count_cores(record(0) + record(2, 32) + record(0, 80)), 2)
        self.assertEqual(cpu_threads.count_cores(record(0) + struct.pack('<II', 0, 0)), 1)
        self.assertEqual(cpu_threads.count_cores(b''), 0)

    def test_physical_cores_on_this_windows_pc_are_plausible(self):
        cores = cpu_threads.physical_cores()
        self.assertTrue(1 <= cores <= (os.cpu_count() or cores))

    def test_uses_physical_cores_capped_at_eight(self):
        with mock.patch.dict(os.environ, {'BLITZDIC_CPU_THREADS': ''}):
            for cores, expected in ((2, 2), (4, 4), (6, 6), (12, 8), (0, 1)):
                with mock.patch.object(cpu_threads, 'physical_cores', return_value=cores):
                    self.assertEqual(cpu_threads.inference_threads(), expected)

    def test_measurement_override_accepts_only_1_to_64(self):
        with mock.patch.object(cpu_threads, 'physical_cores', return_value=6):
            for value, expected in (('3', 3), ('64', 64), ('0', 6), ('65', 6), ('-2', 6), ('vier', 6)):
                with mock.patch.dict(os.environ, {'BLITZDIC_CPU_THREADS': value}):
                    self.assertEqual(cpu_threads.inference_threads(), expected)


if __name__ == '__main__':
    unittest.main()
