import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'

const statusMessages = {
    converting: "Convertendo...",
    generating: "Transcrevendo...",
    uploading: "Carregando...",
    success: "sucesso!"
}

interface VideoUploadedFormProps {
    onVideoUploaded: (videoId: string) => void
}

export function VideoInputForm(props: VideoUploadedFormProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [status, setStatus] = useState<status>('waiting')
    const promptInputRef = useRef<HTMLTextAreaElement>(null)

    const convertVideoToAudio = async (video: File) => {
        console.log("convert started");

        const ffmpeg = await getFFmpeg()

        await ffmpeg.writeFile('input.mp4', await fetchFile(video))

        ffmpeg.on('progress', progress => {
            console.log(`Convert progress ${Math.round(progress.progress * 100)}`);
        })

        await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3',
        ])

        const data = await ffmpeg.readFile('output.mp3')

        const audioFileBlob = new Blob([data], { type: 'audio/mpeg' })
        const audioFile = new File([audioFileBlob], 'audio.mp3', {
            type: 'audio/mpeg',
        })

        console.log('Convert finished.')
        return audioFile

    }

    const handleUploadVideo = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const prompt = promptInputRef.current?.value

        if (!videoFile) {
            return
        }

        setStatus('converting')

        const audioFile = await convertVideoToAudio(videoFile)


        const data = new FormData()

        data.append("file", audioFile)

        setStatus('uploading')

        const response = await api.post("/videos", data)

        const videoId = response.data.insertVideoDb.id

        setStatus('generating')
        await api.post(`/videos/${videoId}/transcription`, { prompt })

        setStatus('success')

        props.onVideoUploaded(videoId)
    }



    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
        const { files } = event.currentTarget

        if (!files) {
            return
        }

        const videoSelect = files[0]
        setVideoFile(videoSelect)
    }

    const previewVideo = useMemo(() => {
        if (!videoFile) {
            return null
        }

        return URL.createObjectURL(videoFile)
    }, [videoFile])

    return (
        <form
            onSubmit={handleUploadVideo}
            className="space-y-6"
        >
            <label htmlFor="video" className="flex border rounded-md aspect-video overflow-hidden relative cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:border-primary hover:bg-primary/5">
                {
                    previewVideo
                        ? <video src={previewVideo} controls={false} className="pointer-events-none absolute inset-0" />
                        : (
                            <>
                                <FileVideo className="w-4 h-4" />
                                Carregar vídeo
                            </>
                        )

                }
            </label>

            <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelect} />

            <Separator />

            <div
                className="space-y-2"
            >
                <Label
                    htmlFor="transcription_prompt"
                >
                    Prompt de transcrição
                </Label>
                <Textarea
                    disabled={status !== 'waiting'}
                    ref={promptInputRef}
                    placeholder="Inclua palavras-chave mencionadas no vídeo separados por vírgula"
                    className="min-h-20 leading-relaxed"
                    id="transcription_prompt"
                />
            </div>

            <Button
                type="submit"
                className="w-full data-[success=true]:bg-emerald-600"
                data-success={status === 'success'}
                disabled={status !== 'waiting'}
            >
                {
                    status === "waiting"
                        ? (
                            <>
                                Carregar vídeo
                                <Upload className="w-4 h-4 ml-2" />
                            </>
                        )
                        : statusMessages[status]
                }
            </Button>

        </form>
    )
}