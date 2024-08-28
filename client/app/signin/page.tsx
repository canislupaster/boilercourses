import { AppWrapper } from "@/components/wrapper";
import { getInfo } from "../server";
import { SignIn } from "./signin";

export default async function Page() {
	return <AppWrapper info={await getInfo()} ><SignIn/></AppWrapper>;
}