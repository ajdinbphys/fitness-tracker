export function PacerLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <svg width="40" height="40" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="22" height="22" rx="6" fill="hsl(var(--primary))" />
        <path d="M6 15L10 8L13 12.5L15.5 9" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="15.5" cy="9" r="1.25" fill="white"/>
      </svg>
      <span className="text-lg font-semibold tracking-tight text-foreground">Pacer</span>
    </div>
  )
}
