// AxiA symbol and logotype, from the brand files in public/brand/ (AxiA_Symbol.svg, AxiA_Logotype.svg).
// Drawn in currentColor so they follow the text colour. Change the brand here and in those files together.
const SYMBOL = "M1000,19.7V5c0-3.6-3.7-6-7-4.6l-484.8,217.3c-5.2,2.3-11.2,2.3-16.4,0L7,.4C3.7-1,0,1.4,0,5v49.6C0,59.7,2,64.7,5.5,68.4l253.1,265.1c4.4,4.6,3.4,12.1-2,15.4L4.7,504.5C1.8,506.3,0,509.6,0,513v14.7c0,3.6,3.7,6,7,4.6l484.8-217.3c5.2-2.3,11.2-2.3,16.4,0l484.8,217.3c3.3,1.5,7-.9,7-4.6v-49.6c0-5.1-2-10.1-5.5-13.8l-253.1-265.1c-4.4-4.6-3.4-12.1,2-15.4L995.3,28.2c2.9-1.8,4.7-5,4.7-8.5Z";
const LOGOTYPE = [
  "M635.4,64.2c23,0,35.7-11.6,35.7-32.1S655.6,0,634.8,0s-35.1,14.2-35.1,32.6,9.2,31.6,35.7,31.6h0Z",
  "M856.2,12.1h-22.4l-139.6,350h-31.4V122.1h-194.7v21.1h29.3v3.2l-61.2,76.4-74.2-100.6h-62.7l102.3,132.6-84.2,107.4h-10L171.9,12.1h-22.4L0,383.7h34.7l42.7-113.7h130.3l40.4,113.7h89.4l82.5-107.4,80.5,107.4h218.3l42.7-113.7h130.3l40.4,113.7h67.6L856.2,12.1ZM87.9,241.7l57-142.7h1.7l52.5,142.7s-111.2,0-111.2,0ZM608,362.1h-61l-92.3-120,83-98.9h70.4v219h-.1ZM772,241.7l57.2-142.7h1.7l52.4,142.7h-111.3Z",
];

// label: give it to announce "AxiA" to screen readers; leave it out when a nearby link already says so.
export function AxiaSymbol({ height = 16, label, ...rest }) {
  return (
    <svg viewBox="0 0 1000 532.7" height={height} fill="currentColor" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} {...rest}>
      <path d={SYMBOL} />
    </svg>
  );
}

export function AxiaLogotype({ height, label, ...rest }) {
  return (
    <svg viewBox="0 0 999.8 383.7" height={height} fill="currentColor" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} {...rest}>
      {LOGOTYPE.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
