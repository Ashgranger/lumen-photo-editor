import { Adjustments } from "./imageProcessing";

export interface Preset {
  name: string;
  emoji: string;
  colors: string[];
  adj: Partial<Adjustments>;
}

export const PRESETS: Preset[] = [
  { name:"Original", emoji:"○", colors:["#555","#777","#999"], adj:{} },
  { name:"Vivid",    emoji:"🔥", colors:["#ff4d6d","#ff8c42","#ffcb57"], adj:{saturation:45,vibrance:30,contrast:22,clarity:15} },
  { name:"Cinematic",emoji:"🎬", colors:["#1a3a5c","#2d6a8c","#f5a623"], adj:{temp:-15,contrast:32,highlights:-35,shadows:22,saturation:-12,vignette:-45} },
  { name:"Golden",   emoji:"✨", colors:["#f7971e","#ffd200","#fff5ba"], adj:{temp:60,tint:10,saturation:18,exposure:6,highlights:-8} },
  { name:"Noir",     emoji:"⬛", colors:["#111","#444","#ddd"], adj:{saturation:-100,contrast:50,highlights:-20,clarity:28} },
  { name:"Fade",     emoji:"🌫", colors:["#b0b8c0","#c8d0d8","#dde4eb"], adj:{exposure:12,contrast:-35,saturation:-18,blacks:38} },
  { name:"Sunset",   emoji:"🌅", colors:["#ff6b35","#f7931e","#fcee21"], adj:{temp:72,tint:18,saturation:32,highlights:12,contrast:18} },
  { name:"Arctic",   emoji:"❄️", colors:["#6ee7ff","#a5f3fc","#e0f7fa"], adj:{temp:-50,tint:-15,saturation:10,clarity:12} },
  { name:"Moody",    emoji:"🌑", colors:["#1a1a2e","#16213e","#533483"], adj:{exposure:-18,contrast:28,saturation:-22,highlights:-45,vignette:-65} },
  { name:"Chrome",   emoji:"💿", colors:["#c0c0d0","#909090","#404060"], adj:{contrast:38,saturation:28,shadows:28,highlights:-18,clarity:22} },
  { name:"Forest",   emoji:"🌿", colors:["#2d5a27","#4a8c3f","#8bc34a"], adj:{temp:-8,saturation:38,vibrance:22,clarity:18,shadows:22} },
  { name:"Matte",    emoji:"🎨", colors:["#8b7355","#a0856c","#c4a882"], adj:{blacks:38,contrast:-22,saturation:15,highlights:-28} },
];
