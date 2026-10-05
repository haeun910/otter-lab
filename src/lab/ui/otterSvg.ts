// 오터랩 마스코트 얼굴 (2D). 화면(OtterFace)과 카드 이미지(캔버스)가 같은 그림을 써요.
export const OTTER_SVG_INNER = `
<ellipse cx="9.5" cy="29" rx="4.6" ry="4" fill="#7A5136"/>
<ellipse cx="54.5" cy="29" rx="4.6" ry="4" fill="#7A5136"/>
<ellipse cx="32" cy="36" rx="26" ry="19" fill="#A8754F"/>
<ellipse cx="32" cy="45" rx="17" ry="9" fill="#FCEBD5"/>
<ellipse cx="26.5" cy="42" rx="6.6" ry="5.4" fill="#FCEBD5"/>
<ellipse cx="37.5" cy="42" rx="6.6" ry="5.4" fill="#FCEBD5"/>
<ellipse cx="32" cy="38.6" rx="4.8" ry="3.1" fill="#4A3326"/>
<circle cx="31" cy="37.8" r="0.9" fill="#fff"/>
<path d="M29.5 46.2 Q32 48.4 34.5 46.2" stroke="#4A3326" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<circle cx="23" cy="42.5" r="0.9" fill="#7A5136"/>
<circle cx="21" cy="45" r="0.9" fill="#7A5136"/>
<circle cx="41" cy="42.5" r="0.9" fill="#7A5136"/>
<circle cx="43" cy="45" r="0.9" fill="#7A5136"/>
<circle cx="20.5" cy="33" r="3.2" fill="#2A2230"/>
<circle cx="43.5" cy="33" r="3.2" fill="#2A2230"/>
<circle cx="21.7" cy="31.8" r="1.1" fill="#fff"/>
<circle cx="44.7" cy="31.8" r="1.1" fill="#fff"/>
<ellipse cx="15" cy="40.5" rx="3.6" ry="2.2" fill="#FF9FAE" opacity="0.6"/>
<ellipse cx="49" cy="40.5" rx="3.6" ry="2.2" fill="#FF9FAE" opacity="0.6"/>
<ellipse cx="35" cy="17.5" rx="15.5" ry="5.6" fill="#FF9A8A" transform="rotate(-12 35 17.5)"/>
<circle cx="36" cy="12.6" r="2.4" fill="#EE6B57"/>`;

export const otterSvgMarkup = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${OTTER_SVG_INNER}</svg>`;
