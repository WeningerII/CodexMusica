# Windows: find_library('c') is None on VS2015+ builds, and CDLL("libc.so.6") raises an OSError subclass.
import ctypes, ctypes.util
ctypes.util.find_library = lambda name: None
_real = ctypes.CDLL
class _CDLL(_real):
    def __init__(self, name, *a, **k):
        if name == "libc.so.6":
            raise FileNotFoundError("Could not find module 'libc.so.6' (or one of its dependencies)")
        super().__init__(name, *a, **k)
ctypes.CDLL = _CDLL
