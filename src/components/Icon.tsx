import homeIcon from "@/assets/icons/home.svg";
import searchIcon from "@/assets/icons/search.svg";
import plusIcon from "@/assets/icons/plus.svg";
import settingsIcon from "@/assets/icons/settings.svg";
import checkIcon from "@/assets/icons/check.svg";
import alertIcon from "@/assets/icons/alert.svg";
import closeIcon from "@/assets/icons/close.svg";
import arrowRightIcon from "@/assets/icons/arrow-right.svg";
import moonIcon from "@/assets/icons/moon.svg";
import sunIcon from "@/assets/icons/sun.svg";

type IconName =
  | "home"
  | "search"
  | "plus"
  | "settings"
  | "check"
  | "alert"
  | "close"
  | "arrow-right"
  | "moon"
  | "sun";

const map: Record<IconName, string> = {
  home: homeIcon,
  search: searchIcon,
  plus: plusIcon,
  settings: settingsIcon,
  check: checkIcon,
  alert: alertIcon,
  close: closeIcon,
  "arrow-right": arrowRightIcon,
  moon: moonIcon,
  sun: sunIcon
};

export function Icon({
  name,
  className,
  alt
}: {
  name: IconName;
  className?: string;
  alt?: string;
}) {
  return <img src={map[name]} alt={alt ?? ""} aria-hidden={alt ? undefined : true} className={className} />;
}
