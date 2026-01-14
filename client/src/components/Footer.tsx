const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
};

export function Footer() {
  return (
    <footer 
      className="border-t py-4 px-4 text-center text-sm"
      style={{ backgroundColor: colors.cream, borderColor: colors.creamDark, color: colors.brownLight }}
    >
      <p>&copy; 2026 Erwin Mills Coffee Company. All rights reserved.</p>
    </footer>
  );
}
