import { colors } from '@/lib/colors';

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
