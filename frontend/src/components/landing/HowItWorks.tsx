'use client';

const steps = [
  {
    number: '01',
    title: 'Upload Documents',
    description: 'PDF, DOCX, or any text-based files via the Admin Panel or API.',
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Configure LLM',
    description: 'Choose your provider: OpenAI, Anthropic, Groq, or local Ollama.',
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Call the API',
    description: 'REST or WebSocket — start chatting with your documents instantly.',
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
];

const codeExample = `# 1. Start the service
docker-compose up -d

# 2. Upload a document
curl -X POST http://localhost:8000/api/documents/upload \\
  -H "X-Admin-Key: your-admin-key" \\
  -F "file=@handbook.pdf"

# 3. Chat with your docs
curl -X POST http://localhost:8000/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "What is the vacation policy?",
    "session_id": "user_123"
  }'`;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-50">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Up and Running in 3 Steps
          </h2>
          <p className="text-lg text-surface-600 max-w-2xl mx-auto">
            No complex setup. No ML expertise required. Just deploy and start chatting.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary-400/50 to-transparent" />
              )}

              <div className="text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-surface-100 border border-surface-300 text-primary-400 mb-6">
                  {step.icon}
                </div>

                {/* Step number */}
                <div className="text-sm font-mono text-primary-400 mb-2">
                  {step.number}
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-white mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-surface-600 text-sm">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Code example */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-surface-200 border-b border-surface-300">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-sm text-surface-600 ml-2">terminal</span>
            </div>

            {/* Code content */}
            <div className="p-6 overflow-x-auto">
              <pre className="text-sm leading-relaxed">
                <code>
                  {codeExample.split('\n').map((line, i) => (
                    <div key={i} className="whitespace-pre">
                      {line.startsWith('#') ? (
                        <span className="text-surface-500">{line}</span>
                      ) : line.startsWith('curl') || line.startsWith('docker') ? (
                        <>
                          <span className="text-green-400">{line.split(' ')[0]}</span>
                          <span className="text-surface-700">{' ' + line.slice(line.indexOf(' ') + 1)}</span>
                        </>
                      ) : line.trim().startsWith('-') ? (
                        <span className="text-surface-700">{line}</span>
                      ) : line.trim().startsWith('"') || line.trim().startsWith('{') || line.trim().startsWith('}') || line.trim().startsWith("'") ? (
                        <span className="text-yellow-400">{line}</span>
                      ) : (
                        <span className="text-surface-700">{line}</span>
                      )}
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
