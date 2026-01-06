'use client';

import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-50/20 via-transparent to-transparent pointer-events-none" />

      {/* Glow effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-200/50 border border-surface-300 rounded-full text-sm text-surface-700 mb-8">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Open Source & Self-Hosted
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Turn Any Document Into a{' '}
            <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              Production-Ready Chatbot API
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-surface-600 mb-10 max-w-2xl mx-auto">
            Open-source, self-hosted RAG-as-a-Service. PDF, Docx, Web, SQL —
            deploy in minutes, not weeks. API-first design for seamless backend integration.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/chat"
              className="w-full sm:w-auto px-8 py-3 bg-primary-400 hover:bg-primary-300 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-primary-400/25"
            >
              Try Demo
            </Link>
            <Link
              href="https://github.com/porygonlabs/rag-chatbot"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-3 bg-surface-200 hover:bg-surface-300 text-white font-semibold rounded-xl border border-surface-300 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              View on GitHub
            </Link>
          </div>

          {/* Code Preview */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden shadow-2xl">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-surface-200 border-b border-surface-300">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-sm text-surface-600 ml-2">API Request</span>
              </div>

              {/* Code content */}
              <div className="p-6 text-left overflow-x-auto">
                <pre className="text-sm sm:text-base">
                  <code>
                    <span className="text-primary-500">POST</span>{' '}
                    <span className="text-surface-700">/api/chat</span>
                    {'\n\n'}
                    <span className="text-surface-600">{'{'}</span>
                    {'\n'}
                    <span className="text-surface-600">{'  '}</span>
                    <span className="text-green-400">&quot;message&quot;</span>
                    <span className="text-surface-600">: </span>
                    <span className="text-yellow-400">&quot;What is the refund policy?&quot;</span>
                    <span className="text-surface-600">,</span>
                    {'\n'}
                    <span className="text-surface-600">{'  '}</span>
                    <span className="text-green-400">&quot;session_id&quot;</span>
                    <span className="text-surface-600">: </span>
                    <span className="text-yellow-400">&quot;user_123&quot;</span>
                    {'\n'}
                    <span className="text-surface-600">{'}'}</span>
                    {'\n\n'}
                    <span className="text-surface-500">{'// Response streams in real-time...'}</span>
                    {'\n'}
                    <span className="text-primary-400">{'→'}</span>{' '}
                    <span className="text-surface-700">Based on your documentation, the refund policy states...</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
