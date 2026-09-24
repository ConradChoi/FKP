// Placeholder body for /seepn/my pages that exist in the Figma U-11 side menu but whose feature
// is not built yet — keeps every menu item a live route (no dead links) until each gets its real
// implementation. Replace the page file's contents when the feature ships.
import Link from 'next/link'

export function MyComingSoon({ title, description, action }: { title: string; description: string; action?: { href: string; label: string } }) {
  return (
    <div>
      <h1 className="text-h3 text-neutral-900">{title}</h1>
      <div className="mt-6 rounded-card border border-dashed border-neutral-200 bg-white p-10 text-center">
        <p className="text-body text-neutral-700">준비 중인 기능입니다.</p>
        <p className="mt-2 text-body-sm text-neutral-500">{description}</p>
        {action && (
          <Link href={action.href} className="mt-4 inline-block text-body-sm text-primary-600 hover:underline">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  )
}
