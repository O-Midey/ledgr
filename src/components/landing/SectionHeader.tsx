interface Props {
  label: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeader({ label, title, description, align = "left" }: Props) {
  return (
    <header className={`section-header ${align === "center" ? "center" : ""}`}>
      <div className="section-label">{label}</div>
      <h2 className="section-title">{title}</h2>
      {description && <p className="section-desc">{description}</p>}
    </header>
  );
}
