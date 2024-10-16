"use client"

import { Footer } from "@/components/footer";

import { Button, textColor } from "@/components/util";
import { decodeQueryToSearchState, encodeSearchState, Search, SearchState } from "./search";

import { searchState } from "@/components/clientutil";
import { Logo, LogoText } from "@/components/logo";
import { ButtonRow } from "@/components/settings";
import { AppCtx, callAPI } from "@/components/wrapper";
import { IconDice5Filled } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useContext } from "react";

function Landing({setSearch}: {setSearch: (s: string) => void}) {
	const randomCourse = callAPI<number, object>("random");
	const router = useRouter();
	const ctx = useContext(AppCtx);

	return <>
		<div className="flex-col z-40 grid place-content-center mx-4 h-[80dvh] items-center">
			<ButtonRow className="w-full justify-end" />
			<div className='flex flex-col items-center my-2 gap-6 md:my-4 lg:my-0 lg:mt-4 lg:mb-6'>
				<Logo onClick={() => setSearch("")} className='my-auto max-h-52 cursor-pointer w-auto' />
				<LogoText onClick={() => setSearch("")} />
			</div>
			<input
				id="landingSearch"
				type="text" autoFocus
				placeholder="I want to take a class about..."
				onChange={(e) => setSearch(e.target.value) }
				className={`${textColor.contrast} text-lg md:text-xl bg-transparent w-full pb-2 border-b-2 focus:outline-none focus:border-blue-500 transition duration-300`}
			/>
			<div className="mt-4 flex flex-col items-center">
				<Button icon={<IconDice5Filled className="group-hover:rotate-180 transition-transform duration-1000" />} disabled={randomCourse.loading} onClick={() => {
					randomCourse.run({noCache: true, refresh(r) { router.push(`/course/${r.res}`); }})
				}} >
					I{"'"}m feeling lucky
				</Button>

				<div className="mt-5 text-center px-5" >
					Featuring <b className="font-black font-display px-0.5 mx-0.5 py-0.5 bg-amber-300 text-black" >{ctx.info.nCourses}</b> courses<br/>and
					{" "}<b className="font-black font-display px-0.5 mx-0.5 py-0.5 bg-orange-300 text-black" >{ctx.info.nInstructor}</b> instructors.
				</div>
			</div>

			<div className="absolute bottom-0 left-0 top-0 right-0 flex flex-col items-center justify-end -z-10 min-h-[40rem]" >
				<Footer/>
			</div>
		</div>
	</>;
}

export default function App() {
	const [initSearch, setInitSearch] = searchState<[Partial<SearchState>,boolean]|null>(null, (x) => {
		return [decodeQueryToSearchState(x),false];
	}, (x) => {
		if (x==null) return;
		return encodeSearchState(x[0]);
	});

	return initSearch ?
		<Search init={initSearch[0]} autoFocus={initSearch[1]} clearSearch={()=>setInitSearch(null)} setSearchState={(s) => {
			setInitSearch([s,false]);
		}} includeLogo />
		: <Landing setSearch={(s) => setInitSearch([{query: s}, true])} />;
}