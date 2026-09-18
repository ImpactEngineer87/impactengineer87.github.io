import type { Metadata } from "next";
import Link from "next/link";
import TradingDashboard from "@/components/TradingDashboard";
import "@/app/trading-dashboard.css";

export const metadata: Metadata = {
  title: "Trading Bot Interface | Thando Thomo",
  description: "A static interface preview of Thando Thomo's algorithmic trading dashboard.",
};

export default function TradingDashboardPage() {
  return (
    <div className="trading-page">
      <div className="trading-preview-note">
        <Link href="/#project-05">← Back to selected work</Link>
        <span>Portfolio interface preview · Static data · No trading controls</span>
      </div>
      <TradingDashboard />
    </div>
  );
}
