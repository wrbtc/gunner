// Each Flight Settings slider shows its value beside the label, so a player
// can return to a setting they liked. The sliders keep their markup; the
// readouts are added here and follow every change, including the values the
// game restores from saved preferences.
const FORMATS={
  volume:v=>`${v}%`,
  voiceVolume:v=>`${v}%`,
  musicVolume:v=>`${v}%`,
  sensitivity:v=>`${(v/100).toFixed(2)}×`,
  fov:v=>`${v}°`
};

export function mountSettingReadouts(root){
  const readouts=[];
  for(const input of root.querySelectorAll('input[type=range]')){
    const format=FORMATS[input.id]||(v=>String(v));
    const output=document.createElement('output');
    output.className='setting-value';
    output.htmlFor=input.id;
    output.setAttribute('aria-hidden','true');
    input.before(output);
    const update=()=>{output.textContent=format(Math.round(Number(input.value)));};
    input.addEventListener('input',update);
    readouts.push(update);
  }
  const refresh=()=>{for(const update of readouts)update();};
  refresh();
  return {refresh};
}
