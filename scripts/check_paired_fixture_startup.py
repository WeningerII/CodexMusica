"""Actual offline startup/replay/restart fixture preflight; not a capacity run."""
import argparse
import json
import os
from pathlib import Path
import tempfile
import sys
sys.dont_write_bytecode = True
from paired_library_capacity_probe import PairedRuntime

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--fixtures',required=True)
    ap.add_argument('--out',required=True,type=Path)
    args=ap.parse_args()
    os.environ['PAIRED_CAPACITY_FIXTURES']=args.fixtures
    receipt={'status':'failed','approval':'unreviewed','scope':'fixture startup/replay/restart only; no capacity cells'}
    with tempfile.TemporaryDirectory(prefix='612-fixture-startup-') as directory:
        runtime=PairedRuntime(directory,library_mode='loaded')
        try:
            runtime.start()
            runtime.replay()
            receipt['runtime']=runtime.finish()
            if receipt['runtime'].get('errors'):
                raise RuntimeError('resident fixture preflight recorded errors')
            receipt['status']='passed'
        except BaseException as error:
            receipt['error']=type(error).__name__+': '+str(error)
            raise
        finally:
            try: runtime.close()
            finally:
                receipt['runtime']=runtime.record
                receipt['logs']={p.name:p.read_text()[-16000:] for p in Path(directory).glob('*.stderr')}
                args.out.write_text(json.dumps(receipt,indent=2)+'\n')

if __name__=='__main__':main()
