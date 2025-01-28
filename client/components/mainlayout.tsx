import React, { useState } from "react";
import { BackButton, useLg } from "./clientutil";
import { Footer } from "./footer";
import { ButtonRow } from "./settings";
import { bgColor, Button } from "./util";

export function MainLayout({left, right, rightTabs, bottom, title, extraButtons}: {
	left: React.ReactNode, right: React.ReactNode, rightTabs: {key: string, title: React.ReactNode, body: React.ReactNode}[], bottom: React.ReactNode, title: React.ReactNode, extraButtons?: React.ReactNode
}) {
	const isLg = useLg();
	const [cur, setCurTab] = useState(rightTabs[0].key);
	const v = rightTabs.find(({key})=>key==cur);

	return <div className="flex flex-col gap-2" >
		<div className="flex lg:flex-row flex-col gap-4 items-stretch relative" >
			<div className="flex flex-col md:mr-3 justify-start h-full basis-5/12 md:flex-shrink-0">
				<div className="flex flex-col sm:flex-row gap-2 items-start sm:justify-between w-full mb-3 sm:mb-6" >
					<BackButton>
						{title}
					</BackButton>

					{!isLg && <ButtonRow>{extraButtons}</ButtonRow>}
				</div>

				{left}
			</div>
			<div className="flex flex-col flex-grow max-w-full gap-4 lg:max-w-[50dvw]" >
				<div className="flex flex-col items-stretch" >
					<div className="flex flex-row justify-between gap-2 mb-2 max-w-full items-start" >
						<div className="flex flex-row gap-2 items-center text-nowrap max-w-full overflow-x-auto" >
							{rightTabs.map(({key,title})=>
								<Button key={key} className={key==cur ? `border-blue-500 ${bgColor.hover}` : ""}
									onClick={()=>setCurTab(key)} >{title}</Button>)}
						</div>
						{isLg && <ButtonRow>{extraButtons}</ButtonRow>}
					</div>
					
					{v && <React.Fragment key={v.key} >{v.body}</React.Fragment>}

					{right}
				</div>
			</div>
		</div>

		{bottom}

		<Footer/>
	</div>
}