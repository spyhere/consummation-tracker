const { PrismaClient } = require("@prisma/client")
const createEntryRequest = require("../requests/createEntryRequests")
const EntryService = require("../services/entryService")

const prisma = new PrismaClient()

class EntryController {

  static async index(req, res) {
    const userId = Number(req.params.user) || req.user.id
    const takeLimit = Number(process.env.ENTRIES_PAGINATION)

    const result = await prisma.day.findMany({
      take: takeLimit + 1,
      ...req.query.cursor && {
        cursor: {
          id: Number(req.query.cursor),
        },
      },
      where: {
        User: {
          some: {
            id: userId
          }
        }
      },
      include: {
        Entry: {
          where: {
            user_id: userId
          },
          orderBy: {
            createdAt: 'desc'
          },
        }
      },
      orderBy: {
        daytime: 'desc'
      }
    })

    const dates = EntryService.addCaloriesCountPerDay(result)

    let cursor
    if (dates.length > takeLimit) {
      cursor = dates.pop()?.id || null
    } else {
      cursor = null
    }

    res.send({
      data: { dates },
      meta: { cursor }
    })
  }

  static async filterEntriesByDates(req, res) {
    const userId = req.user.id
    const toDate = req.query.to || new Date()
    const fromDate = req.query.from

    const result = await prisma.day.findMany({
      where: {
        User: {
          some: {
            id: userId
          }
        },
        daytime: {
          lte: toDate,
          gte: fromDate,
        }
      },
      include: {
        Entry: {
          where: {
            user_id: userId
          },
          orderBy: {
            createdAt: 'desc'
          },
        }
      },
      orderBy: {
        daytime: 'desc'
      }
    })

    const dates = EntryService.addCaloriesCountPerDay(result)

    res.send({
      data: { dates },
    })
  }

  static async store(req, res) {
    const hasErrors = createEntryRequest(req.body)
    if (!!hasErrors) {
      const [statusCode, errorMessage] = hasErrors
      return res.status(statusCode).send(errorMessage)
    }

    const user_id = Number(req.params.user) || req.user.id
    const { calories, food, price, time } = req.body

    const daytime = time.split("T")[0] || new Date().toISOString().split("T")[0]
    const day = await prisma.day.upsert({
      where: { daytime },
      update: {},
      create: {
        daytime
      }
    })
    const [newEntry] = await prisma.$transaction([
      prisma.entry.create({
        data: {
          calories: Number(calories),
          food,
          price: Number(price) || 0,
          User: {
            connect: {
              id: Number(user_id)
            }
          },
          Day: {
            connect: {
              id: day.id
            }
          },
        },
        include: {
          Day: true
        }
      }),
      prisma.user.update({
        where: {
          id: user_id
        },
        data: {
          Day: {
            connect: {
              id: day.id
            }
          }
        }
      })
    ])

    res.status(201).send({ data: newEntry })
  }

  static async update(req, res) {
    const hasErrors = createEntryRequest(req.body)
    if (!!hasErrors) {
      return res.status(hasErrors[0]).send(hasErrors[1])
    }

    const { calories, food, price } = req.body
    const entryId = Number(req.params.entry)

    try {
      const entry = await prisma.entry.update({
        where: { id: entryId },
        data: {
          calories: Number(calories),
          food,
          price: Number(price) || 0,
          updatedAt: new Date()
        }
      })
      res.send({ data: entry })
    } catch (e) {
      res.status(400).send(e.message)
    }
  }

  static async destroy(req, res) {
    const entryId = Number(req.params.entry)

    try {
      await prisma.entry.delete({
        where: { id: entryId }
      })
      res.send()
    } catch (e) {
      res.status(400).send(e.message)
    }
  }

  static async getStats(req, res) {
    const userId = Number(req.params.user) || req.user.id
    const monthStart = new Date(
        new Date(
            new Date().setDate(1)
        ).setHours(0, 0, 0, 0)
    )
    const dayStart = new Date(new Date().setHours(0, 0, 0, 0))

    const [monthMoneySpent, dayCalories] = await prisma.$transaction([
      prisma.entry.aggregate({
        _sum: {
          price: true,
        },
        where: {
          user_id: userId,
          createdAt: {
            lte: new Date(),
            gte: monthStart,
          },
        }
      }),
      prisma.entry.aggregate({
        _sum: {
          calories: true
        },
        where: {
          user_id: userId,
          createdAt: {
            gte: dayStart,
          }
        }
      })
    ])

    res.send({
      data: {
        monthMoneySpent: monthMoneySpent._sum.price,
        dayCalories: dayCalories._sum.calories
      }
    })
  }
}

module.exports = EntryController
