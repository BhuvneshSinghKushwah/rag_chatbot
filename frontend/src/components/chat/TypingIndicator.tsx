'use client';

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex items-center gap-1 bg-neutral-800 rounded-2xl px-4 py-3">
        <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full" />
        <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full" />
        <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full" />
      </div>
    </div>
  );
}
