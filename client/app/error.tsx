"use client"

import { bgColor, StatusPage } from "@/components/util";

export default function Error({ error, }: { error: Error&{digest?:string}, reset:()=>void }) {
  return <StatusPage title="Whoopsies" >
    <p>That{"'"}s not good. Something involving [REDACTED] occurred.</p>
    <p>Hash: <pre className={`${bgColor.default} p-2 inline rounded-lg`} >{error.digest==undefined ? "no hash" : error.digest}</pre></p>
  </StatusPage>;
}