interface Props {
  wpm: number;
  accuracy: number;
  timer: string;
}

export function LiveStats({ wpm, accuracy, timer }: Props) {
  return (
    <div className="flex items-center gap-6 font-mono text-sm">
      <div className="flex flex-col items-start">
        <span className="text-[color:var(--type-muted)] text-xs">wpm</span>
        <span className="text-[color:var(--type-accent)] text-2xl leading-none">{wpm}</span>
      </div>
      <div className="flex flex-col items-start">
        <span className="text-[color:var(--type-muted)] text-xs">acc</span>
        <span className="text-[color:var(--type-accent)] text-2xl leading-none">
          {Math.round(accuracy)}%
        </span>
      </div>
      <div className="flex flex-col items-start">
        <span className="text-[color:var(--type-muted)] text-xs">time</span>
        <span className="text-[color:var(--type-accent)] text-2xl leading-none">{timer}</span>
      </div>
    </div>
  );
}
