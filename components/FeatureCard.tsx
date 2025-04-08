import { Card } from '@/components/ui/card'

export default function FeatureCard({ icon, title, description }) {
  return (
    <Card className="p-6 text-center sm:text-left">
      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
        {icon}
        <h3 className="ml-0 sm:ml-3 mt-2 sm:mt-0 text-lg font-semibold">
          {title}
        </h3>
      </div>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </Card>
  )
}
