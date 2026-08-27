import { PublicationsScreen } from "./home/PublicationsScreen";
import { useTheme } from "../../context/ThemeContext";

export default function PublicationsTab() {
  const { colors } = useTheme();
  return <PublicationsScreen colors={colors} />;
}
