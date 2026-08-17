export default function Home() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h2 className="text-4xl font-bold tracking-tight">
          The job feed that knows which listings are already dead
        </h2>
        <p className="max-w-2xl text-lg text-gray-600">
          Every job aggregator degrades silently. Listings stay "open" months after the role was
          filled. Revenant detects that — and knows exactly when.
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: 'Ghost Detection',
            desc: 'Proven dead: removed from the company's own board, still listed here',
            emoji: '👻',
          },
          {
            title: 'Liveness Score',
            desc: '0–100, with reasons. Age, re-post churn, apply-link status, and more',
            emoji: '📊',
          },
          {
            title: 'Self-Healing',
            desc: 'When a board changes layout, extraction repairs itself automatically',
            emoji: '🔧',
          },
          {
            title: 'Tailored Resume',
            desc: 'CV rewrites against the actual role, every change traced to the posting',
            emoji: '📄',
          },
        ].map((item) => (
          <div key={item.title} className="space-y-2 rounded-lg border border-gray-200 bg-white p-6">
            <div className="text-3xl">{item.emoji}</div>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-gray-600">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-2xl font-bold">Get started</h3>
        <div className="flex gap-4">
          <a
            href="/feed"
            className="inline-flex items-center gap-2 rounded-lg bg-live px-6 py-3 font-semibold text-white hover:bg-green-600"
          >
            View Feed
          </a>
          <a
            href="/health"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-semibold hover:bg-gray-50"
          >
            Health Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
