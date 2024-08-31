import React from "react";
import { Chivo, Inter } from 'next/font/google';
import { Metadata } from "next";
import banner from "../public/banner.png";
import "./style.css";
import { AppWrapper, GoatCounter } from "@/components/wrapper";
import { getInfo } from "./server";

const chivo = Chivo({ subsets: ['latin'], display: 'swap', variable: "--chivo" });
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: "--inter" });

const desc = "BoilerCourses - Purdue's unofficial course catalog with thousands of Purdue University courses. Find geneds, grades, prerequisites, schedules, and more.";
const title="BoilerCourses - Purdue Course Catalog";
const url = process.env.NEXT_PUBLIC_ROOT_URL!;
const domain = new URL(url).host;

const goatCounter = process.env.NEXT_PUBLIC_GOAT_COUNTER!==undefined && process.env.NEXT_PUBLIC_GOAT_COUNTER.length>0
  ? process.env.NEXT_PUBLIC_GOAT_COUNTER : null;

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title, description: desc,
  icons: { icon: "/icon-color.png" },
  keywords: [ 'Purdue', 'Purdue University', 'Purdue Courses', 'BoilerCourses', 'Boiler Courses',
    'Boiler', 'Courses', 'BoilerCourses', 'Boiler Course', "Class", "Course", 'Catalog', 'Catalogue',
    'Purdue Course Search', 'Purdue Course Catalog', 'Boilermakers', "Self-service", "Schedule",
    "Semester", "Calendar", "Review", "Rating", "Professor", "Grade" ],
  openGraph: {
    url: "/", type: "website",
    title, description: desc,
    images: [banner.src]
  },
  twitter: {
    card: "summary_large_image",
    title, description: desc,
    images: [banner.src]
  }
};

export default async function RootLayout({ children, }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${chivo.variable} dark font-body bg-neutral-950 text-white`} >
      <head>
        <meta name='og:locality' content='West Lafayette' />
        <meta name='og:region' content='IN' />
        <meta name='og:postal-code' content='47906' />
        <meta name='og:postal-code' content='47907' />

        <meta property="twitter:domain" content={domain} />
        <meta property="twitter:url" content={url} />

        <link rel="canonical" href={url} />

        {goatCounter && <GoatCounter goatCounter={goatCounter} />}
      </head>
      <body>
        <AppWrapper info={await getInfo()} >
          {children}
        </AppWrapper>
      </body>
    </html>
  )
}