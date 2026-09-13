# Reproject NASA Blue Marble to the Equal Earth extent used by src/atlas.js.
# Usage: python scripts/project_earth.py INPUT_JPEG OUTPUT_WEBP
import sys
from PIL import Image
import numpy as np
im=np.asarray(Image.open(sys.argv[1]).convert('RGB'));h,w=im.shape[:2]
A1,A2,A3,A4=1.340264,-.081106,.000893,.003796
W,H=2048,1000
xx,yy=np.meshgrid(np.linspace(-2.70663,2.70663,W),np.linspace(1.317363,-1.317363,H))
t=yy/A1
for _ in range(12):
 t-= (t*(A1+A2*t**2+A3*t**6+A4*t**8)-yy)/(A1+3*A2*t**2+7*A3*t**6+9*A4*t**8)
lat=np.arcsin(np.clip(2*np.sin(t)/np.sqrt(3),-1,1));lon=xx*np.sqrt(3)*(A1+3*A2*t**2+7*A3*t**6+9*A4*t**8)/(2*np.cos(t))
mask=(np.abs(lon)<=np.pi)&(np.abs(t)<=np.pi/3)
x=np.clip(((lon+np.pi)/(2*np.pi)*(w-1)).astype(int),0,w-1);y=np.clip(((np.pi/2-lat)/np.pi*(h-1)).astype(int),0,h-1)
out=np.zeros((H,W,4),dtype=np.uint8);out[:,:,:3]=im[y,x];out[:,:,3]=mask*255
Image.fromarray(out).save(sys.argv[2],quality=88)
