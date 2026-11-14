import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useUniwind } from "uniwind";
import { ArrowClockwiseIcon } from "phosphor-react-native/src/icons/ArrowClockwise";
import { ArrowLeftIcon } from "phosphor-react-native/src/icons/ArrowLeft";
import { ArrowSquareOutIcon } from "phosphor-react-native/src/icons/ArrowSquareOut";
import { BellIcon } from "phosphor-react-native/src/icons/Bell";
import { BellSlashIcon } from "phosphor-react-native/src/icons/BellSlash";
import { BuildingsIcon } from "phosphor-react-native/src/icons/Buildings";
import { CalendarIcon } from "phosphor-react-native/src/icons/Calendar";
import { CameraIcon } from "phosphor-react-native/src/icons/Camera";
import { CaretDownIcon } from "phosphor-react-native/src/icons/CaretDown";
import { CaretLeftIcon } from "phosphor-react-native/src/icons/CaretLeft";
import { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight";
import { CaretUpIcon } from "phosphor-react-native/src/icons/CaretUp";
import { CarrotIcon } from "phosphor-react-native/src/icons/Carrot";
import { ChartBarIcon } from "phosphor-react-native/src/icons/ChartBar";
import { ChatCircleDotsIcon } from "phosphor-react-native/src/icons/ChatCircleDots";
import { ChatsIcon } from "phosphor-react-native/src/icons/Chats";
import { ChecksIcon as CheckDoubleIcon } from "phosphor-react-native/src/icons/Checks";
import { CheckIcon } from "phosphor-react-native/src/icons/Check";
import { CheckCircleIcon } from "phosphor-react-native/src/icons/CheckCircle";
import { ClipboardTextIcon } from "phosphor-react-native/src/icons/ClipboardText";
import { ClockIcon } from "phosphor-react-native/src/icons/Clock";
import { CloudArrowUpIcon } from "phosphor-react-native/src/icons/CloudArrowUp";
import { CloudSlashIcon } from "phosphor-react-native/src/icons/CloudSlash";
import { CloudSunIcon } from "phosphor-react-native/src/icons/CloudSun";
import { CopyIcon } from "phosphor-react-native/src/icons/Copy";
import { DeviceMobileIcon } from "phosphor-react-native/src/icons/DeviceMobile";
import { DownloadSimpleIcon } from "phosphor-react-native/src/icons/DownloadSimple";
import { DropIcon } from "phosphor-react-native/src/icons/Drop";
import { DotsThreeVerticalIcon } from "phosphor-react-native/src/icons/DotsThreeVertical";
import { EnvelopeIcon } from "phosphor-react-native/src/icons/Envelope";
import { EyeIcon } from "phosphor-react-native/src/icons/Eye";
import { EyeSlashIcon } from "phosphor-react-native/src/icons/EyeSlash";
import { FileTextIcon } from "phosphor-react-native/src/icons/FileText";
import { FilePdfIcon } from "phosphor-react-native/src/icons/FilePdf";
import { FirstAidIcon } from "phosphor-react-native/src/icons/FirstAid";
import { FirstAidKitIcon } from "phosphor-react-native/src/icons/FirstAidKit";
import { FlaskIcon } from "phosphor-react-native/src/icons/Flask";
import { FolderOpenIcon } from "phosphor-react-native/src/icons/FolderOpen";
import { GenderFemaleIcon } from "phosphor-react-native/src/icons/GenderFemale";
import { GenderMaleIcon } from "phosphor-react-native/src/icons/GenderMale";
import { GitBranchIcon } from "phosphor-react-native/src/icons/GitBranch";
import { GpsFixIcon } from "phosphor-react-native/src/icons/GpsFix";
import { HeartIcon } from "phosphor-react-native/src/icons/Heart";
import { HeartBreakIcon } from "phosphor-react-native/src/icons/HeartBreak";
import { HeartbeatIcon } from "phosphor-react-native/src/icons/Heartbeat";
import { HourglassIcon } from "phosphor-react-native/src/icons/Hourglass";
import { HouseIcon } from "phosphor-react-native/src/icons/House";
import { ImagesIcon } from "phosphor-react-native/src/icons/Images";
import { ImageIcon } from "phosphor-react-native/src/icons/Image";
import { InfoIcon } from "phosphor-react-native/src/icons/Info";
import { KeyIcon } from "phosphor-react-native/src/icons/Key";
import { LeafIcon } from "phosphor-react-native/src/icons/Leaf";
import { LightningIcon } from "phosphor-react-native/src/icons/Lightning";
import { LinkIcon } from "phosphor-react-native/src/icons/Link";
import { ListIcon } from "phosphor-react-native/src/icons/List";
import { MoonIcon } from "phosphor-react-native/src/icons/Moon";
import { MicrophoneIcon } from "phosphor-react-native/src/icons/Microphone";
import { MagnifyingGlassIcon } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { PaperPlaneTiltIcon } from "phosphor-react-native/src/icons/PaperPlaneTilt";
import { SunIcon } from "phosphor-react-native/src/icons/Sun";
import { PersonIcon } from "phosphor-react-native/src/icons/Person";
import { PhoneIcon } from "phosphor-react-native/src/icons/Phone";
import { PlusIcon } from "phosphor-react-native/src/icons/Plus";
import { PlusCircleIcon } from "phosphor-react-native/src/icons/PlusCircle";
import { PulseIcon } from "phosphor-react-native/src/icons/Pulse";
import { QrCodeIcon } from "phosphor-react-native/src/icons/QrCode";
import { ScalesIcon } from "phosphor-react-native/src/icons/Scales";
import { ShareNetworkIcon } from "phosphor-react-native/src/icons/ShareNetwork";
import { ShieldCheckIcon } from "phosphor-react-native/src/icons/ShieldCheck";
import { GearSixIcon } from "phosphor-react-native/src/icons/GearSix";
import { SlidersHorizontalIcon } from "phosphor-react-native/src/icons/SlidersHorizontal";
import { SmileyIcon } from "phosphor-react-native/src/icons/Smiley";
import { TextTIcon } from "phosphor-react-native/src/icons/TextT";
import { TrashIcon } from "phosphor-react-native/src/icons/Trash";
import { TrendDownIcon } from "phosphor-react-native/src/icons/TrendDown";
import { TrendUpIcon } from "phosphor-react-native/src/icons/TrendUp";
import { UserIcon } from "phosphor-react-native/src/icons/User";
import { UserCircleIcon } from "phosphor-react-native/src/icons/UserCircle";
import { VideoCameraIcon } from "phosphor-react-native/src/icons/VideoCamera";
import { UsersIcon } from "phosphor-react-native/src/icons/Users";
import { WarningCircleIcon } from "phosphor-react-native/src/icons/WarningCircle";
import { XIcon } from "phosphor-react-native/src/icons/X";
import { XCircleIcon } from "phosphor-react-native/src/icons/XCircle";

export type AppIconName = string;
export type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  weight?: "fill" | "bold" | "regular";
  className?: string;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
};

const iconMap: Record<string, ComponentType<any>> = {
  "add": PlusIcon,
  "add-circle": PlusCircleIcon,
  "alert-circle": WarningCircleIcon,
  "alert-circle-outline": WarningCircleIcon,
  "arrow-back": ArrowLeftIcon,
  "arrow-up-right-box-outline": ArrowSquareOutIcon,
  "body": PersonIcon,
  "business-outline": BuildingsIcon,
  "calendar": CalendarIcon,
  "calendar-outline": CalendarIcon,
  "call-outline": PhoneIcon,
  "camera-outline": CameraIcon,
  "chatbubble-ellipses": ChatCircleDotsIcon,
  "chatbubble-ellipses-outline": ChatCircleDotsIcon,
  "chatbubbles": ChatsIcon,
  "checkmark-done": CheckDoubleIcon,
  "checkmark": CheckIcon,
  "checkmark-circle": CheckCircleIcon,
  "checkmark-circle-outline": CheckCircleIcon,
  "checkmark-done-circle-outline": CheckCircleIcon,
  "checkmark-outline": CheckIcon,
  "chevron-back": CaretLeftIcon,
  "chevron-down": CaretDownIcon,
  "chevron-forward": CaretRightIcon,
  "chevron-up": CaretUpIcon,
  "clipboard-outline": ClipboardTextIcon,
  "close": XIcon,
  "close-circle": XCircleIcon,
  "close-circle-outline": XCircleIcon,
  "cloud-offline-outline": CloudSlashIcon,
  "cloud-upload-outline": CloudArrowUpIcon,
  "copy-outline": CopyIcon,
  "document-text": FileTextIcon,
  "document-text-outline": FileTextIcon,
  "file-pdf": FilePdfIcon,
  "image": ImageIcon,
  "download-outline": DownloadSimpleIcon,
  "dots-vertical": DotsThreeVerticalIcon,
  "eye-off-outline": EyeSlashIcon,
  "eye-outline": EyeIcon,
  "female": GenderFemaleIcon,
  "fitness-outline": HeartbeatIcon,
  "flash": LightningIcon,
  "flash-outline": LightningIcon,
  "flask-outline": FlaskIcon,
  "folder-open-outline": FolderOpenIcon,
  "git-branch-outline": GitBranchIcon,
  "happy-outline": SmileyIcon,
  "heart": HeartIcon,
  "heart-circle-outline": HeartIcon,
  "heart-dislike-outline": HeartBreakIcon,
  "heart-outline": HeartIcon,
  "home-outline": HouseIcon,
  "hourglass-outline": HourglassIcon,
  "images-outline": ImagesIcon,
  "information-circle": InfoIcon,
  "information-circle-outline": InfoIcon,
  "key-outline": KeyIcon,
  "leaf-outline": LeafIcon,
  "link-outline": LinkIcon,
  "list": ListIcon,
  "mail-outline": EnvelopeIcon,
  "mic-outline": MicrophoneIcon,
  "male": GenderMaleIcon,
  "medical": FirstAidIcon,
  "medkit": FirstAidKitIcon,
  "medkit-outline": FirstAidKitIcon,
  "navigate-outline": GpsFixIcon,
  "notifications-off-outline": BellSlashIcon,
  "notifications-outline": BellIcon,
  "moon-outline": MoonIcon,
  "nutrition": CarrotIcon,
  "open-outline": ArrowSquareOutIcon,
  "videocam-outline": VideoCameraIcon,
  "options-outline": SlidersHorizontalIcon,
  "partly-sunny-outline": CloudSunIcon,
  "people-outline": UsersIcon,
  "people": UsersIcon,
  "person": UserIcon,
  "person-circle-outline": UserCircleIcon,
  "person-outline": UserIcon,
  "phone-portrait-outline": DeviceMobileIcon,
  "pulse": PulseIcon,
  "pulse-outline": PulseIcon,
  "qr-code-outline": QrCodeIcon,
  "settings-outline": GearSixIcon,
  "refresh": ArrowClockwiseIcon,
  "refresh-circle-outline": ArrowClockwiseIcon,
  "refresh-outline": ArrowClockwiseIcon,
  "scale-outline": ScalesIcon,
  "search-outline": MagnifyingGlassIcon,
  "share-social-outline": ShareNetworkIcon,
  "send": PaperPlaneTiltIcon,
  "shield-checkmark": ShieldCheckIcon,
  "shield-checkmark-outline": ShieldCheckIcon,
  "sunny-outline": SunIcon,
  "stats-chart-outline": ChartBarIcon,
  "text-outline": TextTIcon,
  "time-outline": ClockIcon,
  "trash": TrashIcon,
  "trash-outline": TrashIcon,
  "trending-down": TrendDownIcon,
  "trending-up": TrendUpIcon,
  "water-outline": DropIcon,
  "woman-outline": GenderFemaleIcon,
};

export function AppIcon({ name, size = 20, color, weight = "fill", style }: AppIconProps) {
  const { theme } = useUniwind();
  const Icon = iconMap[name] ?? FileTextIcon;
  const resolvedWeight =
    (name === "checkmark" || name === "checkmark-done" || name === "checkmark-outline") &&
    weight === "fill"
      ? "bold"
      : weight;
  return (
    <Icon
      size={size}
      color={color ?? (theme === "dark" ? "#f5f5f5" : "#262626")}
      weight={resolvedWeight}
      style={style}
    />
  );
}
