import { metadataKeywords, textColor } from "@/components/util";
import { AppWrapper, GoatCounter } from "@/components/wrapper";
import { Metadata } from "next";
import { Chivo, Inter } from 'next/font/google';
import React from "react";
import banner from "../public/banner.png";
import { catchAPIError, getInfo } from "./server";
import "./style.css";
import { commaNum } from "../../shared/types";

const chivo = Chivo({ subsets: ['latin'], display: 'swap', variable: "--chivo" });
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: "--inter" });

const url = process.env.NEXT_PUBLIC_ROOT_URL!;
const domain = new URL(url).host;

const goatCounter = process.env.NEXT_PUBLIC_GOAT_COUNTER!==undefined && process.env.NEXT_PUBLIC_GOAT_COUNTER.length>0
  ? process.env.NEXT_PUBLIC_GOAT_COUNTER : null;

export async function generateMetadata(): Promise<Metadata> {
  const info = await getInfo();
  const desc = `BoilerCourses - a refreshing Purdue course catalog with ${commaNum(info.nCourses)} courses and ${commaNum(info.nInstructor)} instructors. View grades, prerequisites, schedules, reviews and more.`
  const title = "BoilerCourses, Purdue's cooler course catalog";

  return {
    metadataBase: new URL(url),
    alternates: { canonical: "/" },
    title: "BoilerCourses",
    description: desc,
    keywords: metadataKeywords,
    applicationName: "BoilerCourses",
    icons: { icon: "/icon-color.png" },
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
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${chivo.variable} font-body ${textColor.default} dark:bg-neutral-950 bg-neutral-100`} >
      <head>
        <meta name='og:locality' content='West Lafayette' />
        <meta name='og:region' content='IN' />
        <meta name='og:postal-code' content='47906' />
        <meta name='og:postal-code' content='47907' />

        <meta property="twitter:domain" content={domain} />
        <meta property="twitter:url" content={url} />

        {goatCounter && <GoatCounter goatCounter={goatCounter} />}
      </head>
      <body>
        {await catchAPIError(async ()=>
          <AppWrapper info={await getInfo()} >
            {children}
          </AppWrapper>
        )()}
      </body>
    </html>
  )
}