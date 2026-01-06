'use client';

const valueProps = [
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
    title: 'API-First Design',
    description:
      'Built for backend integration. RESTful endpoints + WebSocket streaming. No UI lock-in — use your own frontend or integrate directly.',
  },
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    title: 'Deploy in Minutes',
    description:
      'Docker-ready out of the box. Upload documents, configure your LLM provider, and start chatting. Zero ML expertise required.',
  },
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    title: 'Self-Hosted & Private',
    description:
      'Your data stays on your infrastructure. Full control over your documents and conversations. No vendor lock-in.',
  },
];

export function ValueProps() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {valueProps.map((prop, index) => (
            <div
              key={index}
              className="text-center p-8 rounded-2xl bg-surface-100 border border-surface-300 hover:border-primary-400/50 transition-colors"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-400/10 text-primary-400 mb-6">
                {prop.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                {prop.title}
              </h3>
              <p className="text-surface-600 leading-relaxed">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
