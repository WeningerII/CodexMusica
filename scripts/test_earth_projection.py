#!/usr/bin/env python3
"""Independent geographic anchors and identical shared tile samples."""
import unittest
import numpy as np
from build_earth_tiles import inverse_grid, EXTENT


class ProjectionTests(unittest.TestCase):
    def test_independent_forward_anchors(self):
        for lat, lon in [(0, 0), (51.5, -.12), (-33.86, 151.2),
                         (40.7, -74), (80, 179), (-80, -179)]:
            la, lo = np.radians([lat, lon])
            t = np.arcsin(np.sqrt(3)/2*np.sin(la))
            x = 2*lo*np.cos(t)/(np.sqrt(3)*(1.340264-3*.081106*t*t+7*.000893*t**6+9*.003796*t**8))
            y = t*(1.340264-.081106*t*t+.000893*t**6+.003796*t**8)
            px = (x-EXTENT[0])/(EXTENT[2]-EXTENT[0])*86400-.5
            py = (EXTENT[3]-y)/(EXTENT[3]-EXTENT[1])*42048-.5
            got_lon, got_lat, valid = inverse_grid(np.array([px]), np.array([py]), 86400, 42048)
            self.assertTrue(valid[0, 0])
            self.assertAlmostEqual(float(np.degrees(got_lon[0, 0])), lon, places=7)
            self.assertAlmostEqual(float(np.degrees(got_lat[0, 0])), lat, places=7)

    def test_gutters_match_neighbor_samples(self):
        a = inverse_grid(np.arange(511, 1025), np.arange(511, 1025), 86400, 42048)
        b = inverse_grid(np.arange(1023, 1537), np.arange(511, 1025), 86400, 42048)
        np.testing.assert_array_equal(a[0][:, -2:], b[0][:, :2])
        np.testing.assert_array_equal(a[2][:, -2:], b[2][:, :2])

    def test_outside_earth_transparent(self):
        _, _, mask = inverse_grid(np.array([0, 86399]), np.array([0, 42047]), 86400, 42048)
        self.assertFalse(mask.any())


if __name__ == '__main__':
    unittest.main()
