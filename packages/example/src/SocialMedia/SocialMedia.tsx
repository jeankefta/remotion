import React from 'react';
import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';

type Post = {
	id: number;
	texte: string;
	likes: number;
	appearsAtFrame: number;
	likesAtFrame: number;
};

const POSTS: Post[] = [
	{
		id: 1,
		texte: 'Bonjour tout le monde ! Bienvenue sur mon app. 🎉',
		likes: 12,
		appearsAtFrame: 30,
		likesAtFrame: 90,
	},
	{
		id: 2,
		texte: 'React + Remotion = animations vidéo incroyables !',
		likes: 34,
		appearsAtFrame: 90,
		likesAtFrame: 150,
	},
	{
		id: 3,
		texte: 'JavaScript est le meilleur langage pour le web. 🚀',
		likes: 8,
		appearsAtFrame: 150,
		likesAtFrame: 210,
	},
];

function Post({
	post,
	frame,
	fps,
}: {
	post: Post;
	frame: number;
	fps: number;
}) {
	const progress = spring({
		fps,
		frame: frame - post.appearsAtFrame,
		config: {damping: 14, stiffness: 80},
		durationInFrames: 30,
	});

	const likeProgress = spring({
		fps,
		frame: frame - post.likesAtFrame,
		config: {damping: 12, stiffness: 100},
		durationInFrames: 20,
	});

	const opacity = interpolate(progress, [0, 1], [0, 1]);
	const translateY = interpolate(progress, [0, 1], [30, 0]);
	const likes = Math.round(interpolate(likeProgress, [0, 1], [0, post.likes]));

	if (frame < post.appearsAtFrame) return null;

	return (
		<div
			style={{
				background: '#f7f7f7',
				padding: '15px',
				borderRadius: '12px',
				marginTop: '15px',
				opacity,
				transform: `translateY(${translateY}px)`,
			}}
		>
			<p style={{margin: '0 0 10px', fontSize: '14px', color: '#333'}}>
				{post.texte}
			</p>
			<button
				type="button"
				style={{
					background: 'none',
					border: 'none',
					cursor: 'pointer',
					fontSize: '14px',
					color: '#e0245e',
					fontWeight: 'bold',
					padding: 0,
				}}
			>
				❤️ {likes}
			</button>
		</div>
	);
}

export function SocialMedia() {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const titleProgress = spring({
		fps,
		frame,
		config: {damping: 14, stiffness: 80},
		durationInFrames: 30,
	});

	const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
	const titleY = interpolate(titleProgress, [0, 1], [-20, 0]);

	const typingFrame = Math.max(0, frame - 5);
	const messageText = 'Écris quelque chose...';
	const typedLength = Math.min(
		messageText.length,
		Math.floor(typingFrame / 2),
	);
	const displayedText = messageText.slice(0, typedLength);

	return (
		<AbsoluteFill
			style={{
				background: '#f2f4f7',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'flex-start',
				paddingTop: '40px',
				fontFamily: 'Arial, sans-serif',
			}}
		>
			<div
				style={{
					width: '400px',
					background: 'white',
					padding: '25px',
					borderRadius: '20px',
					boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
				}}
			>
				<h1
					style={{
						margin: '0 0 20px',
						fontSize: '22px',
						opacity: titleOpacity,
						transform: `translateY(${titleY}px)`,
					}}
				>
					Mon Application
				</h1>

				<textarea
					readOnly
					value={displayedText}
					style={{
						width: '100%',
						height: '100px',
						padding: '10px',
						borderRadius: '10px',
						border: '1px solid #ccc',
						marginBottom: '10px',
						fontFamily: 'Arial, sans-serif',
						fontSize: '14px',
						resize: 'none',
						boxSizing: 'border-box',
						color: '#999',
					}}
				/>

				<button
					type="button"
					style={{
						width: '100%',
						padding: '12px',
						border: 'none',
						borderRadius: '10px',
						background: 'black',
						color: 'white',
						fontWeight: 'bold',
						cursor: 'pointer',
						fontSize: '15px',
					}}
				>
					Publier
				</button>

				<div>
					{POSTS.map((post) => (
						<Post key={post.id} post={post} frame={frame} fps={fps} />
					))}
				</div>
			</div>
		</AbsoluteFill>
	);
}
