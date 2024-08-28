import { AppWrapper } from "@/components/wrapper";
import { getInfo } from "../server";
import { Admin } from "./admin";

export default async function Page() {
	return <AppWrapper info={await getInfo()} ><Admin/></AppWrapper>;
}