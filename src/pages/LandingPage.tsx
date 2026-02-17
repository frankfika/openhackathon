import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, Zap, Shield, Globe, Cpu } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 md:pt-24 lg:pt-32 pb-16">
        <div className="container px-4 md:px-6 mx-auto relative z-10">
          <div className="flex flex-col items-center text-center space-y-8">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70"
            >
              The Modern Platform for <br className="hidden sm:inline" />
              <span className="text-apple-blue">Open Hackathons</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-[700px] text-lg text-muted-foreground sm:text-xl"
            >
              Host, manage, and judge hackathons with an Apple-inspired experience. 
              Open source, self-hosted, and powered by AI.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto bg-apple-blue hover:bg-apple-blue/90 text-white rounded-full px-8">
                  Get Started
                </Button>
              </Link>
              <Link to="/hackathons">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8">
                  Explore Events
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
        
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-apple-blue/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-apple-light/50 dark:bg-apple-gray/10">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Everything you need to run a hackathon
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From registration to judging, we've reimagined the entire workflow.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Trophy className="h-10 w-10 text-apple-blue" />}
              title="Seamless Management"
              description="Create sessions, manage rounds, and track progress with ease."
            />
            <FeatureCard 
              icon={<Users className="h-10 w-10 text-apple-blue" />}
              title="Team Formation"
              description="Smart matching for participants to find the perfect teammates."
            />
            <FeatureCard 
              icon={<Zap className="h-10 w-10 text-apple-blue" />}
              title="Real-time Judging"
              description="Assign judges, score projects, and see results instantly."
            />
            <FeatureCard 
              icon={<Shield className="h-10 w-10 text-apple-blue" />}
              title="Secure & Private"
              description="Data isolation and role-based access control for peace of mind."
            />
            <FeatureCard 
              icon={<Globe className="h-10 w-10 text-apple-blue" />}
              title="Open Source"
              description="Deploy on your own infrastructure with Docker support."
            />
            <FeatureCard 
              icon={<Cpu className="h-10 w-10 text-apple-blue" />}
              title="AI Powered"
              description="AI judges, plagiarism detection, and content generation."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="bg-foreground text-background rounded-3xl p-8 md:p-16 text-center relative overflow-hidden">
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">
                Ready to host your next event?
              </h2>
              <p className="text-white/80 text-lg">
                Join thousands of organizers and developers on the platform.
              </p>
              <div className="pt-4">
                <Link to="/register">
                  <Button size="lg" variant="secondary" className="rounded-full px-8 h-12 text-base">
                    Create Account
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white/50 backdrop-blur-sm">
      <CardHeader>
        <div className="mb-4 p-3 bg-apple-blue/5 rounded-2xl w-fit">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
