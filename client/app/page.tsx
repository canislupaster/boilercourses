"use client"

import { Footer } from "@/components/footer";

import { textColor, Text, bgColor, borderColor, chipColors, containerDefault, Button } from "@/components/util";
import { decodeQueryToSearchState, encodeSearchState, Search, SearchState } from "./search";

import { AppTooltip, Carousel, searchState, useGpaColor } from "@/components/clientutil";
import { Logo, LogoText } from "@/components/logo";
import { ButtonRow } from "@/components/settings";
import { AppCtx, callAPI, useAPI } from "@/components/wrapper";
import { useContext, useEffect, useMemo, useState } from "react";
import { SmallCourse } from "../../shared/types";
import { Collapse } from "react-collapse";
import { Card } from "@/components/card";

import messages from "./messages.json";
import { twMerge } from "tailwind-merge";
import { LuckyBox } from "@/components/lucky";
import { IconListDetails } from "@tabler/icons-react";

type Message = {
	type: "normal"|"deadline", title?: string, message: string,
	start?: number, end?: number
};

function Countdown({until}: {until: number}) {
	const [time, setTime] = useState<null|number>(null);
	useEffect(()=>{
		let curTimeout: NodeJS.Timeout|null = null;
		const untilNext = () => {
			const nxt = 1001-(Date.now()%1000); //should be strictly in the next second... 1ms delay
			setTime(Math.floor(until-Date.now()/1000));
			curTimeout = setTimeout(untilNext, nxt);
		};

		untilNext();
		return ()=>{
			if (curTimeout!=null) clearTimeout(curTimeout);
		};
	}, [])

	const gpaColor = useGpaColor();

	if (time==null || time<0) return [];
	const day = Math.floor(time/(3600*24)), hr=Math.floor(time/3600)%24, min=Math.floor(time/60)%60, sec=time%60;
	
	return ([[day, "Day"], [hr, "Hour"], [min, "Minute"], [sec, "Second"]] satisfies [number,string][])
		.map(([qty,name],i) => <div className="flex flex-col gap-1 items-center justify-between" key={name} >
			<div style={{backgroundColor: gpaColor(4-i)}} className="p-2 px-3 rounded-md shadow-md" >
				<Text v="md" >{qty<10 ? `0${qty}` : qty}</Text>
			</div>
			<Text v="sm" >{name}{qty!=1 ? "s" : ""}</Text>
		</div>)
}

function Landing({setSearch}: {setSearch: (s: string) => void}) {
	const randomCourse = callAPI<number, object>("random");
	const ctx = useContext(AppCtx);
	const mostViewed = useAPI<SmallCourse[]>("mostviewed");

	const activeMessages = useMemo(()=>{
		const now = Date.now()/1000;
		return (messages as Message[]).filter(msg=>(msg.start==undefined || now>=msg.start) && (msg.end==undefined || now<=msg.end));
	}, []);

	return <div className="flex flex-col items-center mx-4" >
		<div className={`flex flex-col items-center gap-2 max-w-md w-full`} >
			{activeMessages.map((msg,i)=>
				<div key={i} className={twMerge(containerDefault, msg.type=="normal" ? chipColors.blue : `${bgColor.rose} ${borderColor.red}`, "flex flex-col gap-2 px-4 w-full py-2")} >
					{msg.title && <Text v="lg" >{msg.title}</Text>}
					<Text>
						{msg.message}
					</Text>
					{msg.type=="deadline" && msg.end && <Collapse isOpened >
						<div className="flex flex-col items-center" >
							<div className="grid grid-cols-4 gap-2 items-stretch" >
								<Countdown until={msg.end} />
							</div>
						</div>
					</Collapse>}
				</div>
			)}
			<div className='flex flex-col items-center w-full md:w-auto my-2 !mt-[8dvh] gap-2 md:gap-6 md:my-4 lg:mb-6 relative'>
				<ButtonRow className="absolute top-0 right-0" />
				<Logo onClick={() => setSearch("")} className='my-auto max-h-24 cursor-pointer w-auto' />
				<LogoText onClick={() => setSearch("")} />
			</div>
			<form onSubmit={(ev)=>{
				ev.preventDefault();
				setSearch("");
			}} className="contents" >
				<input
					id="landingSearch"
					type="text" autoFocus
					placeholder="I want to take a class about..."
					onChange={(e) => setSearch(e.target.value) }
					className={`${textColor.contrast} text-lg md:text-xl bg-transparent w-full max-w-72 md:max-w-none pb-2 border-b-2 focus:outline-none focus:border-blue-500 transition duration-300`}
				/>
			</form>
			<div className="flex flex-row items-center justify-center mt-5">
				<AppTooltip content={"I'm feeling lucky"} >
					<button className="bg-none border-none outline-none" onClick={() => {
						randomCourse.run({noCache: true, refresh(r) { ctx.goto(`/course/${r.res}`); }})
					}} ><LuckyBox/></button>
				</AppTooltip>

				<div className="text-center px-3" >
					Featuring <b className="font-black font-display px-0.5 mx-0.5 py-0.5 bg-amber-300 text-black" >{ctx.info.nCourses}</b> courses<br/>and
					{" "}<b className="font-black font-display px-0.5 mx-0.5 py-0.5 bg-orange-300 text-black" >{ctx.info.nInstructor}</b> instructors.
				</div>
			</div>
			<Button onClick={()=>setSearch("")} icon={<IconListDetails/>} className="mt-3" >All courses</Button>
		</div>

		<div className="w-full mt-[10dvh]" >
			<Collapse isOpened >
				{mostViewed!=null && mostViewed.res.length>0 && <div className="flex flex-col items-start w-full gap-2" >
					<Text v="big" className="flex flex-row items-center gap-2" >
						👀 Most viewed courses
					</Text>
					<Carousel items={mostViewed.res.map(c=><Card type="card" course={c} className="h-full" />)} />
				</div>}
			</Collapse>
		</div>

		<Footer/>
	</div>;
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