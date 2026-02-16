type Props = {
  title: string;
  subtitle: string;
};

export function TopBar({ title, subtitle }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-copy">
        <p className="eyebrow">{subtitle}</p>
        <h1>{title}</h1>
      </div>
    </header>
  );
}
