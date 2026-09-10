import "./meridian.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Meridian Clinical | Meridian Health Partners",
  description:
    "Meridian Health Partners clinical information system — synthetic EHR for NOA POC",
};

export default function MeridianLayout({ children }: { children: ReactNode }) {
  return children;
}
