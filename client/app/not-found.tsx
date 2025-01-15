import { Anchor, StatusPage } from "@/components/util";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "BoilerCourses - Not Found"
};

export default function Error(_: { error: Error&{digest?:string}, reset:()=>void }) {
  return <StatusPage title="404 not found" >
    <p>Out of your depth? Let{"'"}s go back <Anchor href="/" >home</Anchor>.</p>
  </StatusPage>;
}