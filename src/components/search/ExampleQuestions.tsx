interface ExampleQuestionsProps {
  onSelectQuestion: (question: string) => void;
  disabled?: boolean;
}

const EXAMPLE_QUESTIONS = [
  "Where is validate_token defined?",
  "Who calls validate_token()?",
  "Where is user authentication handled?",
  "Where is the Bluetooth-settings deeplink used?",
  "How to configure repository settings in yaml?",
  "Find deployment instructions in documentation"
];

export function ExampleQuestions({ onSelectQuestion, disabled = false }: ExampleQuestionsProps) {
  return (
    <div className="mt-5 text-left">
      <span className="text-xs font-medium text-zinc-400 block mb-2">
        Try asking:
      </span>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((question, index) => (
          <button
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => onSelectQuestion(question)}
            className="text-xs text-zinc-300 bg-[#111622] hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700/80 px-3 py-1.5 rounded-md transition-colors text-left flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
          >
            <span className="text-cyan-400 group-hover:text-cyan-300">&bull;</span>
            <span>{question}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
