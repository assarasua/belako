type Props = {
  title: string;
  subtitle: string;
  coins: number;
};

export function TopBar({ title, subtitle, coins }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-copy">
        <p className="eyebrow">{subtitle}</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-coin" aria-label="Saldo actual Belako Coin">
        <span>BEL</span>
        <strong>{coins}</strong>
      </div>
    </header>
  );
}
