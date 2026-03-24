import { useState, useRef, useCallback } from 'react'
import { extractApiErrorMessage } from '@/lib/api-error'
import { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form'
import { UseMutationResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Check, FileText, BookOpenText, Trash2, ChevronDown, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'

const GRADIENT_PRESETS = [
  { name: 'Violet Fusion', value: 'from-violet-600/20 via-fuchsia-500/10 to-indigo-600/20' },
  { name: 'Ocean Breeze', value: 'from-blue-500/20 via-sky-500/10 to-indigo-500/20' },
  { name: 'Emerald Teal', value: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/20' },
  { name: 'Sunset Glow', value: 'from-orange-500/20 via-amber-500/10 to-yellow-500/20' },
  { name: 'Rose Garden', value: 'from-rose-500/20 via-pink-500/10 to-red-500/20' },
  { name: 'Forest Green', value: 'from-green-500/20 via-lime-500/10 to-emerald-600/20' },
  { name: 'Slate Storm', value: 'from-slate-600/20 via-gray-500/10 to-zinc-600/20' },
  { name: 'Purple Haze', value: 'from-purple-600/20 via-violet-500/10 to-fuchsia-500/20' },
  { name: 'Coral Reef', value: 'from-red-400/20 via-orange-400/10 to-pink-500/20' },
  { name: 'Midnight Blue', value: 'from-blue-800/20 via-indigo-700/10 to-slate-800/20' },
]

export type HackathonFormValues = {
  title: string
  tagline: string
  city?: string
  prizePool?: string
  startAt: string
  endAt: string
  docsUrl?: string
  submissionSuccessHintText?: string
  submissionSuccessHintImageUrl?: string
}

type MarkdownDoc = {
  fileName: string
  content: string
  contentType?: string
  updatedAt: string
}

export interface GeneralTabProps {
  register: UseFormRegister<HackathonFormValues>
  errors: FieldErrors<HackathonFormValues>
  setValue: UseFormSetValue<HackathonFormValues>
  watch: UseFormWatch<HackathonFormValues>
  handleSubmit: (onSubmit: (data: HackathonFormValues) => void) => (e?: React.BaseSyntheticEvent) => Promise<void>
  onSubmit: (data: HackathonFormValues) => void
  isLocked: boolean
  updateMutationIsPending: boolean
  coverGradient: string
  setCoverGradient: (value: string) => void
  markdownDoc: MarkdownDoc | null | undefined
  uploadMarkdownMutation: UseMutationResult<unknown, Error, { fileName?: string; content: string; isBase64?: boolean }>
  deleteMarkdownMutation: UseMutationResult<unknown, Error, void>
}

export function GeneralTab({
  register,
  errors,
  setValue,
  watch,
  handleSubmit,
  onSubmit,
  isLocked,
  updateMutationIsPending,
  coverGradient,
  setCoverGradient,
  markdownDoc,
  uploadMarkdownMutation,
  deleteMarkdownMutation,
}: GeneralTabProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const successHintImageInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploadingSuccessHintImage, setIsUploadingSuccessHintImage] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const watchedSubmissionSuccessHintImageUrl = watch('submissionSuccessHintImageUrl')

  const processMarkdownFile = useCallback(async (file: File) => {
    const isMarkdown = file.name.match(/\.(md|markdown)$/i)
    const isPDF = file.name.match(/\.pdf$/i)

    if (!isMarkdown && !isPDF) {
      toast.error(t('settings.invalid_file_type', 'Only Markdown (.md/.markdown) or PDF (.pdf) files are supported'))
      return
    }

    try {
      if (isPDF) {
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : ''
            const commaIndex = result.indexOf(',')
            if (commaIndex < 0) {
              reject(new Error('Invalid PDF payload'))
              return
            }
            resolve(result.slice(commaIndex + 1))
          }
          reader.onerror = () => reject(reader.error || new Error('Failed to read PDF file'))
          reader.readAsDataURL(file)
        })
        await uploadMarkdownMutation.mutateAsync({ fileName: file.name, content: base64Content, isBase64: true })
      } else {
        const content = await file.text()
        await uploadMarkdownMutation.mutateAsync({ fileName: file.name, content })
      }
    } catch { /* mutation handles toast */ }
  }, [uploadMarkdownMutation, t])

  const handleMarkdownUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await processMarkdownFile(file)
    event.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processMarkdownFile(file)
  }, [processMarkdownFile])

  const handleSuccessHintImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingSuccessHintImage(true)
    try {
      const uploaded = await api.uploadImage(file)
      setValue('submissionSuccessHintImageUrl', uploaded.url, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      toast.success(t('settings.image_uploaded', 'Image uploaded'))
    } catch (error: unknown) {
      toast.error(extractApiErrorMessage(error, t('settings.image_upload_failed', 'Failed to upload image')))
    } finally {
      setIsUploadingSuccessHintImage(false)
      event.target.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.basic_info')}</CardTitle>
        <CardDescription>{t('settings.basic_info_desc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={isLocked} className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('common.required_fields_hint')}</p>
          <div className="space-y-2">
            <Label htmlFor="title">
              {t('hackathons.title')}
              <span className="ml-1 text-destructive">*</span>
            </Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">
              {t('hackathons.tagline')}
              <span className="ml-1 text-destructive">*</span>
            </Label>
            <Input id="tagline" {...register('tagline')} />
            {errors.tagline && <p className="text-sm text-destructive">{errors.tagline.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startAt">
                {t('hackathons.start_date')}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Input id="startAt" type="date" {...register('startAt')} />
              {errors.startAt && <p className="text-sm text-destructive">{errors.startAt.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">
                {t('hackathons.end_date')}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Input id="endAt" type="date" {...register('endAt')} />
              {errors.endAt && <p className="text-sm text-destructive">{errors.endAt.message as string}</p>}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 p-4">
            <div className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4 text-primary" />
              <Label>{t('settings.docs_section', '赛事详情内容')}</Label>
            </div>
            <p className="text-xs text-muted-foreground">{t('settings.docs_section_desc', '以下两种方式选其一。本地文档优先展示，外链作为备用。')}</p>

            <div className="space-y-2">
              <Label htmlFor="docsUrl" className="text-xs text-muted-foreground">{t('settings.docs_url', '外链（GitBook / Notion 等）')}</Label>
              <Input id="docsUrl" type="url" placeholder="https://docs.example.com" {...register('docsUrl')} />
              {errors.docsUrl && <p className="text-sm text-destructive">{errors.docsUrl.message as string}</p>}
            </div>

            <div className="relative flex items-center gap-3 py-1">
              <div className="flex-1 border-t border-border/60" />
              <span className="text-xs text-muted-foreground">{t('common.or', '或')}</span>
              <div className="flex-1 border-t border-border/60" />
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">{t('settings.markdown_doc', '本地文档（MD / PDF）')}</Label>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,.pdf"
                className="hidden"
                onChange={handleMarkdownUpload}
                disabled={uploadMarkdownMutation.isPending || deleteMarkdownMutation.isPending}
              />

              {markdownDoc ? (
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{markdownDoc.fileName}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {t('settings.markdown_updated_at', { updatedAt: new Date(markdownDoc.updatedAt).toLocaleString() })}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMarkdownMutation.isPending || deleteMarkdownMutation.isPending}
                      >
                        {uploadMarkdownMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMarkdownMutation.mutate()}
                        disabled={uploadMarkdownMutation.isPending || deleteMarkdownMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {markdownDoc.contentType === 'application/pdf' || markdownDoc.fileName.toLowerCase().endsWith('.pdf') ? (
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
                      <iframe
                        src={`data:application/pdf;base64,${markdownDoc.content}`}
                        title={markdownDoc.fileName}
                        className="h-[420px] w-full border-0"
                      />
                    </div>
                  ) : (
                    <Textarea
                      readOnly
                      value={markdownDoc.content}
                      className="min-h-[200px] resize-y bg-background/80 font-mono text-xs"
                    />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  disabled={uploadMarkdownMutation.isPending}
                  className={cn(
                    'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors',
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40',
                    uploadMarkdownMutation.isPending && 'pointer-events-none opacity-50'
                  )}
                >
                  {uploadMarkdownMutation.isPending ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground/60" />
                  )}
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('settings.markdown_upload_hint', 'Click to upload or drag & drop')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.markdown_upload_accept', 'Markdown (.md/.markdown) or PDF (.pdf) files')}</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="submissionSuccessHintText">{t('settings.success_hint_text', 'Submission Success Tip Text')}</Label>
            <Textarea
              id="submissionSuccessHintText"
              rows={3}
              placeholder={t(
                'settings.success_hint_text_placeholder',
                'Example: Join the event community and follow updates. You can scan the QR code below.'
              )}
              {...register('submissionSuccessHintText')}
            />
            {errors.submissionSuccessHintText && (
              <p className="text-sm text-destructive">{errors.submissionSuccessHintText.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('settings.success_hint_image_url', 'Submission Success Image / QR')}</Label>
            <input
              ref={successHintImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
              className="hidden"
              onChange={handleSuccessHintImageUpload}
              disabled={isLocked || isUploadingSuccessHintImage}
            />
            <input type="hidden" {...register('submissionSuccessHintImageUrl')} />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => successHintImageInputRef.current?.click()}
                disabled={isLocked || isUploadingSuccessHintImage}
              >
                {isUploadingSuccessHintImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {t('settings.upload_image', 'Upload')}
              </Button>
              {watchedSubmissionSuccessHintImageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setValue('submissionSuccessHintImageUrl', '', { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                  disabled={isLocked || isUploadingSuccessHintImage}
                >
                  {t('settings.remove_image', 'Remove Image')}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                'settings.success_hint_image_desc',
                'Upload PNG/JPG/SVG images. Recommended for event QR code or support channel poster.'
              )}
            </p>
            {watchedSubmissionSuccessHintImageUrl ? (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                <p className="break-all text-xs text-muted-foreground">{watchedSubmissionSuccessHintImageUrl}</p>
                <img
                  src={watchedSubmissionSuccessHintImageUrl}
                  alt={t('submission.success_hint_image_alt', 'Submission success hint image')}
                  className="max-h-28 w-auto object-contain"
                />
              </div>
            ) : null}
            {errors.submissionSuccessHintImageUrl && (
              <p className="text-sm text-destructive">{errors.submissionSuccessHintImageUrl.message as string}</p>
            )}
          </div>


          <Button
            type="button"
            variant="ghost"
            className="gap-2 text-muted-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
            {t('settings.more_options', 'More Options')}
          </Button>

          {showAdvanced && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('hackathons.city')}</Label>
                  <Input id="city" {...register('city')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prizePool">{t('hackathons.prize_pool')}</Label>
                  <Input id="prizePool" placeholder={t('hackathons.prize_pool_placeholder')} {...register('prizePool')} />
                </div>
              </div>

              <div className="space-y-3">
                <Label>{t('settings.cover_gradient')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.cover_gradient_desc')}</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {GRADIENT_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCoverGradient(preset.value)}
                      className={`relative h-16 rounded-lg bg-gradient-to-r ${preset.value} border-2 transition-all hover:scale-105 ${
                        coverGradient === preset.value
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:border-muted-foreground/30'
                      }`}
                      title={preset.name}
                    >
                      {coverGradient === preset.value && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <span className="absolute bottom-0.5 left-0 right-0 text-center text-[10px] text-muted-foreground truncate px-1">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isLocked && (
            <div className="pt-4">
              <Button type="submit" disabled={updateMutationIsPending}>
                {updateMutationIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save_changes')}
              </Button>
            </div>
          )}
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}
