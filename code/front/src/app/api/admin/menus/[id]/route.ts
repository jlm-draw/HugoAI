import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const menu = await db.menu.findUnique({
      where: { id: params.id }
    })
    
    if (!menu) {
      return new NextResponse('Menu not found', { status: 404 })
    }

    return NextResponse.json(menu)
  } catch (error) {
    console.error('Error fetching menu:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const body = await request.json()
    const updatedMenu = await db.menu.update({
      where: { id: params.id },
      data: {
        name: body.name,
        path: body.path,
        icon: body.icon,
        order: body.order,
        parentId: body.parentId || null
      }
    })

    return NextResponse.json(updatedMenu)
  } catch (error) {
    console.error('Error updating menu:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    await db.menu.delete({
      where: { id: params.id }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting menu:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}