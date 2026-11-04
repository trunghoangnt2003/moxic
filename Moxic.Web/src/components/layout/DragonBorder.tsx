export default function DragonBorder() {
  const text = " 🐉 MOXIC.CO ";
  const repeatedText = text.repeat(30);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden mix-blend-overlay opacity-40">
      {/* Top Edge */}
      <div className="absolute top-1 left-0 flex whitespace-nowrap font-display text-accent text-sm animate-[border-x_30s_linear_infinite]">
        {repeatedText}
      </div>
      
      {/* Bottom Edge */}
      <div className="absolute bottom-1 right-0 flex whitespace-nowrap font-display text-accent text-sm animate-[border-x-reverse_30s_linear_infinite]">
        {repeatedText}
      </div>

      {/* Right Edge */}
      <div className="absolute top-0 right-1 flex whitespace-nowrap font-display text-accent text-sm animate-[border-y_30s_linear_infinite]" style={{ writingMode: 'vertical-rl' }}>
        {repeatedText}
      </div>

      {/* Left Edge */}
      <div className="absolute bottom-0 left-1 flex whitespace-nowrap font-display text-accent text-sm animate-[border-y-reverse_30s_linear_infinite]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
        {repeatedText}
      </div>
    </div>
  );
}
