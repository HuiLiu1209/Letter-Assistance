"""Keep the supplied 4K RGB texels unchanged; only change the image container."""
from pathlib import Path
from PIL import Image, ImageChops
import json
source=Path('source-assets/Final Model and Textures')
target=Path('dist/assets/original-4k');target.mkdir(exist_ok=True)
report=[]
for src in sorted(source.glob('*.tga')):
    image=Image.open(src)
    assert image.mode=='RGB' and image.size==(4096,4096), (src,image.mode,image.size)
    out=target/(src.stem+'.png')
    image.save(out,compress_level=4)
    restored=Image.open(out)
    assert ImageChops.difference(image,restored).getbbox() is None, src
    report.append({'source':src.name,'output':out.name,'size':list(image.size),'mode':image.mode,'pixels_identical':True,'bytes':out.stat().st_size})
    print(src.name,round(out.stat().st_size/1048576,2),'MiB; original pixels verified',flush=True)
Path('outputs/material-review/texture-verification.json').write_text(json.dumps(report,indent=2))
