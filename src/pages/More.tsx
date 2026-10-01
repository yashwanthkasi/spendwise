import { Link } from "react-router-dom";
import {
  Target,
  Repeat2,
  FolderOpen,
  Handshake,
  TrendingUp,
  ArrowLeftRight,
  Download,
  Settings,
  Tags,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
const links = [
  {
    to: "/budgets",
    title: "Budgets",
    description: "Make room for what matters",
    icon: Target,
  },
  {
    to: "/recurring",
    title: "Recurring transactions",
    description: "Rent, subscriptions, and regular income",
    icon: Repeat2,
  },
  {
    to: "/groups",
    title: "Groups",
    description: "Personal, Office, and your next trip",
    icon: FolderOpen,
  },
  {
    to: "/transactions?filter=lending&range=all",
    title: "Money owed",
    description: "Keep track of lending and borrowing",
    icon: Handshake,
  },
  {
    to: "/transactions?filter=investment&range=all",
    title: "Investments",
    description: "Your contributions in one place",
    icon: TrendingUp,
  },
  {
    to: "/transactions?filter=transfer&range=all",
    title: "Transfers",
    description: "Money moving between your accounts",
    icon: ArrowLeftRight,
  },
  {
    to: "/import",
    title: "Import & export",
    description: "Bring your records with you",
    icon: Download,
  },
  {
    to: "/categories",
    title: "Categories",
    description: "Organize transactions your way",
    icon: Tags,
  },
  {
    to: "/settings",
    title: "Settings",
    description: "Account and preferences",
    icon: Settings,
  },
];
export default function More() {
  return (
    <div>
      <PageHeader
        title="More"
        subtitle="The tools you need, when you need them."
      />
      <div className="mt-6 divide-y">
        {links.map(({ to, title, description, icon: Icon }) => (
          <Link key={title} to={to} className="flex items-center gap-4 py-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {description}
              </span>
            </span>
            <ChevronRight size={17} className="text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
