import importlib.util, sys, json
p = sys.argv[1]
spec = importlib.util.spec_from_file_location('integ', p)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
const = getattr(m, 'DEDUPLICATION_DESCRIPTION', None)
print(sys.version.split()[0], 'doc==audit:', m.Duplicates.__doc__ == json.load(open(sys.argv[2]))['deduplication'],
      'const==audit:', const == json.load(open(sys.argv[2]))['deduplication'] if const is not None else 'n/a')
