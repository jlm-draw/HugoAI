import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const menus = await db.menu.findMany({
      orderBy: {
        order: 'asc'
      }
    })
    
    return NextResponse.json(menus)
  } catch (error) {
    console.error('Error fetching menus:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const body = await request.json()
    const newMenu = await db.menu.create({
      data: {
        name: body.name,
        path: body.path,
        icon: body.icon,
        order: body.order,
        parentId: body.parentId || null
      }
    })

    return NextResponse.json(newMenu, { status: 201 })
  } catch (error) {
    console.error('Error creating menu:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}