import Desktop from "./platforms/desktop/Desktop";
import Mobile from "./platforms/mobile/Mobile";
import { usePlatform } from "./shared/hooks/usePlatform";

export default function App() {
  const platform = usePlatform();
  return platform === "mobile" ? <Mobile /> : <Desktop />;
}
