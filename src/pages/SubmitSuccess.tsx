import { Link } from 'react-router-dom'
import { CheckCircle2, Home, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { useActiveHackathon } from '@/lib/active-hackathon'

export function SubmitSuccess() {
  const { t } = useTranslation()
  const { activeHackathon: hackathon } = useActiveHackathon()

  return (
    <div className="container max-w-2xl py-12 md:py-20">
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-12 pb-12 px-6 md:px-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/20">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-500" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-3">
            {t('submission.success_title', 'Project Submitted Successfully!')}
          </h1>

          <p className="text-lg text-muted-foreground mb-2">
            {t('submission.success_subtitle', 'Thank you for submitting your project to')}
          </p>
          <p className="text-xl font-semibold text-foreground mb-6">
            {hackathon.title}
          </p>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t(
                'submission.success_message',
                'We have received your submission. You will receive a confirmation email shortly. Our team will review your project and get back to you.'
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <Home className="h-4 w-4" />
                {t('common.home', 'Back to Home')}
              </Button>
            </Link>
            <Link to="/projects">
              <Button className="gap-2">
                <List className="h-4 w-4" />
                {t('common.view_projects', 'View All Projects')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
